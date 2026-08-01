# blackjack-compression

**v4** — Fibonacci operator coding + Rice + Elias ω + Δ² + Combinadic.

[![npm](https://img.shields.io/npm/v/blackjack-compression)](https://www.npmjs.com/package/blackjack-compression)

## Install

```bash
npm i blackjack-compression
```

## API

```js
import {
  compress, decompress,
  compressBytes, decompressBytes,
  compressFileV3, decompressFileV3,
  compressSet, decompressSet,
  AdaptiveCodec, BlackjackCodec,
} from "blackjack-compression";

const wire = compress([10, 11, 12, 12, 13]);
const back = decompress(wire);

// sorted unique IDs (combinadic)
const setWire = compressSet([1, 5, 10, 100]);
const ids = decompressSet(setWire);

// general files (LZ77 + v4)
const out = compressFileV3(uint8);
```

## v4 layers

| Layer | Role |
|-------|------|
| Blackjack ops | repeat / inc / dec / d2 / rice / normal |
| Rice | geometric residuals |
| Elias ω | unbounded ints (e.g. > 2³⁰) |
| Δ² | second-order prediction |
| Combinadic | sorted unique sets |

## License

MIT
