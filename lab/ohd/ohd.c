/*
 * ohd-c — C shim of the OHD (Omni Head Display) shell router.
 *
 * Router only. Not a codec. Seats compress; this program peeks, tries, gates.
 *
 * ROUTING LAW (mirrors lab/ohd/ohd + DESIGN.md exactly):
 *   1. Scout tries FIRST and WINS whenever it successfully roundtrips
 *      (encode -> decode -> byte-identical compare == DECODE_OK).
 *   2. Sniper runs ONLY if Scout fails or is parked (binary missing /
 *      not executable).
 *   3. The router does NOT compare packed sizes across seats. It never runs
 *      both seats to pick the smaller; the first DECODE_OK wins.
 *
 * Seats (same resolution as the shell router):
 *   scout  = OHD_SCOUT env, else <this-binary-dir>/bin/scout-dial-a
 *            (Dial A / PCC: "<scout> c|d <in> <out>", drives `lb pcc` /
 *            `lb decode` with the Dial-A env itself)
 *   sniper = OHD_SNIPER or SNIPER_BIN env, else `npcc` found on PATH
 *            ("npcc c|d <in> <out>")
 *
 * CLI:
 *   ohd-c compress <in> <out>            first DECODE_OK seat wins; writes the
 *                                        winning seat's packed bytes to <out>
 *                                        (unframed: byte-identical to the seat's
 *                                        native packed output)
 *   ohd-c decompress <seat> <in> <out>    decode packed bytes with that seat's
 *                                        decoder (seat = scout | sniper)
 *
 * Exit codes: 0 = DECODE_OK, 1 = no DECODE_OK / decode failure,
 *             2 = usage error / no seats available.
 *
 * Host gzip/xz/brotli are opponents, not seats: never substituted.
 */
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#define SEAT_SCOUT "scout"
#define SEAT_SNIPER "sniper"

/* ------------------------------------------------------------------ */
/* small file helpers                                                  */
/* ------------------------------------------------------------------ */

static int is_reg_executable(const char *p)
{
    struct stat st;
    return p && stat(p, &st) == 0 && S_ISREG(st.st_mode) && access(p, X_OK) == 0;
}

static int read_file(const char *path, unsigned char **out, size_t *len_out)
{
    int fd = open(path, O_RDONLY);
    struct stat st;
    unsigned char *buf;
    size_t got = 0;

    if (fd < 0) {
        fprintf(stderr, "ohd: cannot open %s: %s\n", path, strerror(errno));
        return -1;
    }
    if (fstat(fd, &st) != 0 || !S_ISREG(st.st_mode)) {
        fprintf(stderr, "ohd: not a regular file: %s\n", path);
        close(fd);
        return -1;
    }
    if ((uintmax_t)st.st_size > (uintmax_t)(SIZE_MAX / 2)) {
        fprintf(stderr, "ohd: file too large: %s\n", path);
        close(fd);
        return -1;
    }
    buf = malloc((size_t)st.st_size + 1);
    if (!buf) {
        fprintf(stderr, "ohd: out of memory\n");
        close(fd);
        return -1;
    }
    while (got < (size_t)st.st_size) {
        ssize_t r = read(fd, buf + got, (size_t)st.st_size - got);
        if (r < 0) {
            if (errno == EINTR)
                continue;
            fprintf(stderr, "ohd: read error %s: %s\n", path, strerror(errno));
            free(buf);
            close(fd);
            return -1;
        }
        if (r == 0)
            break;
        got += (size_t)r;
    }
    close(fd);
    *out = buf;
    *len_out = got;
    return 0;
}

static int write_file(const char *path, const unsigned char *data, size_t len)
{
    int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0666);
    size_t wrote = 0;

    if (fd < 0) {
        fprintf(stderr, "ohd: cannot write %s: %s\n", path, strerror(errno));
        return -1;
    }
    while (wrote < len) {
        ssize_t w = write(fd, data + wrote, len - wrote);
        if (w < 0) {
            if (errno == EINTR)
                continue;
            fprintf(stderr, "ohd: write error %s: %s\n", path, strerror(errno));
            close(fd);
            return -1;
        }
        wrote += (size_t)w;
    }
    if (close(fd) != 0) {
        fprintf(stderr, "ohd: close error %s: %s\n", path, strerror(errno));
        return -1;
    }
    return 0;
}

/* ------------------------------------------------------------------ */
/* seat binary resolution (mirrors the shell router)                   */
/* ------------------------------------------------------------------ */

static void exe_dirname(char *buf, size_t buflen)
{
    char link[PATH_MAX];
    ssize_t n = readlink("/proc/self/exe", link, sizeof(link) - 1);
    char *slash;

    buf[0] = '\0';
    if (n <= 0)
        return;
    link[n] = '\0';
    slash = strrchr(link, '/');
    if (!slash)
        return;
    *slash = '\0';
    if (strlen(link) >= buflen)
        return;
    memcpy(buf, link, strlen(link) + 1);
}

/* scout: OHD_SCOUT env, else <exe-dir>/bin/scout-dial-a */
static int resolve_scout(char *buf, size_t buflen)
{
    const char *env = getenv("OHD_SCOUT");
    char dir[PATH_MAX];

    if (env && env[0] && is_reg_executable(env)) {
        strncpy(buf, env, buflen - 1);
        buf[buflen - 1] = '\0';
        return 0;
    }
    exe_dirname(dir, sizeof(dir));
    if (dir[0]) {
        int n = snprintf(buf, buflen, "%s/bin/scout-dial-a", dir);
        if (n > 0 && (size_t)n < buflen && is_reg_executable(buf))
            return 0;
    }
    return -1;
}

/* sniper: OHD_SNIPER / SNIPER_BIN env, else npcc on PATH */
static int find_on_path(const char *name, char *buf, size_t buflen)
{
    const char *path = getenv("PATH");
    char *copy, *tok, *save = NULL;

    if (!path || !*path)
        return -1;
    copy = strdup(path);
    if (!copy)
        return -1;
    for (tok = strtok_r(copy, ":", &save); tok; tok = strtok_r(NULL, ":", &save)) {
        int n = snprintf(buf, buflen, "%s/%s", tok[0] ? tok : ".", name);
        if (n > 0 && (size_t)n < buflen && is_reg_executable(buf)) {
            free(copy);
            return 0;
        }
    }
    free(copy);
    return -1;
}

static int resolve_sniper(char *buf, size_t buflen)
{
    static const char *keys[] = { "OHD_SNIPER", "SNIPER_BIN", NULL };
    size_t i;

    for (i = 0; keys[i]; i++) {
        const char *env = getenv(keys[i]);
        if (env && env[0] && is_reg_executable(env)) {
            strncpy(buf, env, buflen - 1);
            buf[buflen - 1] = '\0';
            return 0;
        }
    }
    return find_on_path("npcc", buf, buflen);
}

/* ------------------------------------------------------------------ */
/* seat execution: "<bin> c|d <in> <out>"                              */
/* ------------------------------------------------------------------ */

static int run_seat(const char *bin, const char *mode,
                    const char *inp, const char *out)
{
    pid_t pid = fork();
    int status;
    struct stat st;
    int have_out;

    if (pid < 0) {
        fprintf(stderr, "ohd: fork failed: %s\n", strerror(errno));
        return -1;
    }
    if (pid == 0) {
        execl(bin, bin, mode, inp, out, (char *)NULL);
        fprintf(stderr, "ohd: exec %s failed: %s\n", bin, strerror(errno));
        _exit(127);
    }
    while (waitpid(pid, &status, 0) < 0) {
        if (errno != EINTR) {
            fprintf(stderr, "ohd: waitpid failed: %s\n", strerror(errno));
            return -1;
        }
    }
    if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
        fprintf(stderr, "ohd: seat %s %s failed rc=%d\n", bin, mode,
                WIFEXITED(status) ? WEXITSTATUS(status) : -1);
        return -1;
    }
    have_out = (stat(out, &st) == 0 && S_ISREG(st.st_mode));
    if (!have_out || st.st_size == 0) {
        /* parity with the shell router: seat must produce non-empty output */
        fprintf(stderr, "ohd: seat %s %s produced %s output\n", bin, mode,
                have_out ? "empty" : "no");
        return -1;
    }
    return 0;
}

/*
 * try_seat: encode -> decode -> byte-compare.
 * Returns 0 with *packed_out holding the packed bytes on DECODE_OK,
 * -1 otherwise (seat failed; caller moves to the next seat).
 */
static int try_seat(const char *seat_id, const char *bin,
                    const unsigned char *raw, size_t raw_len,
                    const char *work,
                    unsigned char **packed_out, size_t *packed_len_out)
{
    char rawp[PATH_MAX], packp[PATH_MAX], backp[PATH_MAX];
    unsigned char *back = NULL, *packed = NULL;
    size_t back_len = 0, packed_len = 0;
    int rc = -1;

    snprintf(rawp, sizeof(rawp), "%s/raw.bin", work);
    snprintf(packp, sizeof(packp), "%s/%s.packed", work, seat_id);
    snprintf(backp, sizeof(backp), "%s/%s.back", work, seat_id);

    if (write_file(rawp, raw, raw_len) != 0)
        goto done;
    if (run_seat(bin, "c", rawp, packp) != 0) {
        fprintf(stderr, "OHD: seat=%s FAIL encode\n", seat_id);
        goto done;
    }
    if (run_seat(bin, "d", packp, backp) != 0) {
        fprintf(stderr, "OHD: seat=%s FAIL decode\n", seat_id);
        goto done;
    }
    if (read_file(backp, &back, &back_len) != 0)
        goto done;
    if (back_len != raw_len || memcmp(back, raw, raw_len) != 0) {
        fprintf(stderr,
                "OHD: seat=%s FAIL DECODE gate (back %zu bytes vs raw %zu)\n",
                seat_id, back_len, raw_len);
        goto done;
    }
    if (read_file(packp, &packed, &packed_len) != 0)
        goto done;
    *packed_out = packed;
    *packed_len_out = packed_len;
    packed = NULL; /* ownership transferred */
    rc = 0;

done:
    free(back);
    free(packed);
    unlink(rawp);
    unlink(packp);
    unlink(backp);
    return rc;
}

static void usage(void)
{
    fprintf(stderr,
            "usage: ohd-c compress <in> <out>\n"
            "       ohd-c decompress <seat> <in> <out>\n"
            "  seat: scout | sniper\n");
}

int main(int argc, char **argv)
{
    if (argc >= 2 &&
        (strcmp(argv[1], "-h") == 0 || strcmp(argv[1], "--help") == 0)) {
        usage();
        return 2;
    }

    /* ---------------- compress: first DECODE_OK wins ---------------- */
    if (argc == 4 && (strcmp(argv[1], "compress") == 0 || strcmp(argv[1], "c") == 0)) {
        const char *in_path = argv[2], *out_path = argv[3];
        unsigned char *raw = NULL, *packed = NULL;
        size_t raw_len = 0, packed_len = 0;
        char worktmpl[] = "/tmp/ohd-c-XXXXXX";
        char *work;
        struct { const char *id; char bin[PATH_MAX]; int have; } seats[2];
        int nseats = 0, i, rc = 1;

        if (read_file(in_path, &raw, &raw_len) != 0)
            return 2;

        seats[0].id = SEAT_SCOUT;
        seats[0].have = (resolve_scout(seats[0].bin, sizeof(seats[0].bin)) == 0);
        seats[1].id = SEAT_SNIPER;
        seats[1].have = (resolve_sniper(seats[1].bin, sizeof(seats[1].bin)) == 0);
        if (!seats[0].have)
            fprintf(stderr, "OHD: scout PARKED (no Dial A / PCC binary) - try sniper\n");
        if (!seats[1].have)
            fprintf(stderr, "OHD: sniper missing (set OHD_SNIPER or put npcc on PATH)\n");
        for (i = 0; i < 2; i++)
            if (seats[i].have)
                nseats++;
        if (nseats == 0) {
            fprintf(stderr, "OHD: no seats available\n");
            free(raw);
            return 2;
        }

        work = mkdtemp(worktmpl);
        if (!work) {
            fprintf(stderr, "ohd: mkdtemp failed: %s\n", strerror(errno));
            free(raw);
            return 2;
        }

        for (i = 0; i < 2; i++) {
            if (!seats[i].have)
                continue;
            /* LAW: never run the second seat if the first already DECODE_OK'd;
             * never compare packed sizes. First DECODE_OK wins, stop. */
            if (try_seat(seats[i].id, seats[i].bin, raw, raw_len,
                         work, &packed, &packed_len) == 0) {
                if (write_file(out_path, packed, packed_len) != 0) {
                    free(packed);
                    break;
                }
                printf("seat=%s DECODE_OK raw=%zu packed=%zu\n",
                       seats[i].id, raw_len, packed_len);
                free(packed);
                rc = 0;
                break;
            }
        }
        if (rc != 0)
            fprintf(stderr, "OHD: no DECODE_OK from any seat\n");
        free(raw);
        rmdir(work);
        return rc;
    }

    /* ---------------- decompress: decode with the named seat --------- */
    if (argc == 5 &&
        (strcmp(argv[1], "decompress") == 0 || strcmp(argv[1], "d") == 0)) {
        const char *seat = argv[2], *in_path = argv[3], *out_path = argv[4];
        char bin[PATH_MAX];
        struct stat st;

        if (strcmp(seat, SEAT_SCOUT) == 0) {
            if (resolve_scout(bin, sizeof(bin)) != 0) {
                fprintf(stderr, "OHD: frame seat=scout but Scout PARKED\n");
                return 2;
            }
        } else if (strcmp(seat, SEAT_SNIPER) == 0) {
            if (resolve_sniper(bin, sizeof(bin)) != 0) {
                fprintf(stderr, "OHD: frame seat=sniper but sniper binary not found\n");
                return 2;
            }
        } else {
            fprintf(stderr, "OHD: unknown seat '%s'\n", seat);
            return 2;
        }
        if (run_seat(bin, "d", in_path, out_path) != 0) {
            fprintf(stderr, "OHD: decompress fail\n");
            return 1;
        }
        if (stat(out_path, &st) == 0)
            printf("seat=%s DECODE_OK raw=%lld\n", seat, (long long)st.st_size);
        return 0;
    }

    usage();
    return 2;
}
