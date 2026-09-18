/** Rent desk retired. TruGame is parked/building — not for sale. */
(function () {
  try {
    location.replace("/trugame");
  } catch {
    /* ignore */
  }
  window.TruGameRent = {
    async gate() {
      location.replace("/trugame");
      return false;
    },
    checkout() {
      location.href = "/trugame";
    },
  };
})();
