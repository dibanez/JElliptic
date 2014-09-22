﻿/// <reference path="lib/require.d.ts" />
define(["require", "exports", "BigInteger", "ModCurve", "PollardRho"], function(require, exports, BigInteger, ModCurve, PollardRho) {
    function bigintValue(elemName) {
        return BigInteger.parse(document.getElementById(elemName).value);
    }

    requirejs([], function () {
        var btn = document.getElementById("button");
        var content = document.getElementById("content");

        btn.onclick = function (_) {
            var a = bigintValue("a"), b = bigintValue("b"), n = bigintValue("order");
            var gx = bigintValue("gx"), gy = bigintValue("gy");
            var hx = bigintValue("hx"), hy = bigintValue("hy");

            var config = {
                Curve: new ModCurve(a, b, n),
                AdditionTableSeed: 0,
                AdditionTableLength: 128,
                ParrallelWalksCount: 10,
                UseNegationMap: true,
                DistinguishedPointMask: BigInteger.fromInt(0xFF)
            };

            var result = PollardRho.solve(gx, gy, hx, hy, config);
            content.textContent = (result || "Error").toString();
        };
    });
});
//# sourceMappingURL=app.js.map
