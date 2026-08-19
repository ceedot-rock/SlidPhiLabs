/** Rent desk retired. TruGame is the engine. */
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
      location.href = "/pay?sku=trugame-year";
    },
  };
})();
