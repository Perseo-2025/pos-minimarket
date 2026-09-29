import { DniNotFoundError, IdentityServiceUnavailableError } from "@/domain/errors";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";

const SUNAT_BASE_URL = "https://ww1.sunat.gob.pe";
const SUNAT_DNI_PATH = "/ol-ti-itfisdenreg/itfisdenreg.htm";

type SunatDniResponse = {
  lista?: { nombresapellidos?: string }[];
};

// SUNAT returns "APELLIDO_PATERNO APELLIDO_MATERNO, NOMBRES". The POS shows
// names as written on the DNI card front: "NOMBRES APELLIDOS".
export function parseSunatName(raw: string): string | null {
  const [surnamesPart, namesPart] = raw.split(",");
  const surnames = (surnamesPart ?? "").trim();
  const names = (namesPart ?? "").trim();
  const fullName = (names ? `${names} ${surnames}` : surnames)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return fullName.length > 0 ? fullName : null;
}

// Uses SUNAT's public DNI lookup (the same endpoint their web forms use).
// It is not a formal API: it may change or throttle us, which is fine — any
// failure makes the POS fall back to typing the name manually.
export class SunatDniLookup implements IdentityLookup {
  constructor(private readonly timeoutMs: number) {}

  async lookupDni(dni: string) {
    const url = new URL(SUNAT_DNI_PATH, SUNAT_BASE_URL);
    url.searchParams.set("accion", "obtenerDatosDni");
    url.searchParams.set("numDocumento", dni);

    let data: SunatDniResponse;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          // SUNAT sometimes blocks requests without a browser User-Agent.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`SUNAT respondió ${response.status}`);
      }
      // When blocked, SUNAT answers with an HTML page: json() throws.
      data = (await response.json()) as SunatDniResponse;
    } catch (error) {
      console.error("Consulta DNI a SUNAT falló:", (error as Error).message);
      throw new IdentityServiceUnavailableError();
    }

    const raw = data.lista?.[0]?.nombresapellidos;
    const fullName = raw ? parseSunatName(raw) : null;
    if (!fullName) throw new DniNotFoundError("No se encontraron datos para este DNI");

    return { dni, fullName };
  }
}
