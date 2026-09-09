# blackjack-compression

Dual-licensed hosted lossless compression client. `compress()` / `decompress()` / `zip()` / `unzip()` call the live host. Open terms or a paid grant.

```bash
npm i blackjack-compression
```

```js
import { compress, decompress, zip } from "blackjack-compression";

const { packed } = await compress(Buffer.from("hello"));
const archive = await zip([{ path: "a.txt", data: "hello" }]); // .pcc
```

A `.pcc` file is our zip. First 2 GB/month free, then 8¢/GB. Product: [www.slidphilabs.com/gc](https://www.slidphilabs.com/gc)
