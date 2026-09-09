# @cptasz13/tru8

Public zeros demo from Slid Phi Labs: one million zeros compress to 8 bytes and round-trip.

This is not AWARE. AWARE is the hosted compressor at https://www.slidphilabs.com/gc.

```bash
npm i @cptasz13/tru8
npx @cptasz13/tru8
```

```js
import { compress, decompress } from "@cptasz13/tru8";

const packed = compress(Buffer.alloc(1_000_000)); // 8 bytes
const raw = decompress(packed);                   // 1_000_000 zeros
```

Other input is refused. Production compression is a hosted seat, not this package.
