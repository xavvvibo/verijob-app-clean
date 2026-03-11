import test from "node:test";
import assert from "node:assert/strict";
import { OWNER_OVERVIEW_SECTION_TITLES } from "../src/lib/owner-overview-config.js";

test("Owner overview mantiene secciones ejecutivas clave", () => {
  assert.deepEqual(OWNER_OVERVIEW_SECTION_TITLES, [
    "North Star",
    "Activación",
    "Verificación y Confianza",
    "Operación",
  ]);
});
