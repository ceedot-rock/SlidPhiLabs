# @cptasz13/tru8

Dual-licensed compression client from Slid Phi Labs. Primary product face is **PCC**; this package is a demo client, not the current lead. AWARE is a retired alias for PCC.

- All-zero input packs locally to **8 bytes** and round-trips (sync).
- Everything else uses hosted PCC (`compress()` returns a Promise).
- `zip()` / `unzip()` build a `.pcc` archive (our zip).

```bash
npm i @cptasz13/tru8
npx @cptasz13/tru8
```

```js
import { compress, decompress } from "@cptasz13/tru8";

const packed = compress(Buffer.alloc(1_000_000)); // 8 bytes, sync
const raw = decompress(packed);                   // 1_000_000 zeros
```

PCC: https://www.slidphilabs.com/gc · `.pcc` archive format: https://www.slidphilabs.com/archive
