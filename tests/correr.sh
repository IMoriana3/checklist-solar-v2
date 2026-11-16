#!/usr/bin/env bash
# Bancos de la app de control de obra. Sale con 1 si falla cualquiera (cada uno decide por su recuento).
set -uo pipefail
cd "$(dirname "$0")/.."
rc=0
for t in tests/test_plantas.cjs tests/test_cola.cjs tests/test_sin_fijos.cjs tests/test_arranque.cjs tests/test_no_registrado.cjs tests/test_sin_conexion.cjs; do
  echo "── $t"
  node "$t" || rc=1
done
exit $rc
