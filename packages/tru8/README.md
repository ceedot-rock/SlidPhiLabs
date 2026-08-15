# tru8

**Less is more. We dropped the E.**

Public demo token paths. Production residual is licensed.

```bash
npm i @cptasz13/tru8
npx @cptasz13/tru8
```

Unscoped `tru8` is blocked by npm name similarity (`tr46` / `tsup`). This is the public name.

```js
import { compress, decompress } from "tru8";

const packed = compress(Buffer.alloc(1_000_000)); // 8 bytes
const raw = decompress(packed);                   // 1_000_000 zeros
```

| Demo | Raw | TRU8 |
|------|-----|------|
| 1 000 000 zeros | 1 MB | **8 B** |
| `"the"` × 1000 | 3000 B | 1002 B |
| 100 × 1 KB dups | 102400 B | 800 B |

Non-zero / `T_SPARSE` / private residual throw `LicensedPathError`. That is the guard.

Credit: **Powered by TRU8 · Slid Phi Labs**

Demos: https://www.slidphilabs.com/demos  
Year $1,900 (Chamber + TRU8): https://www.slidphilabs.com/license  
Inquire: corey@slidphilabs.com · subject `TRU8`
