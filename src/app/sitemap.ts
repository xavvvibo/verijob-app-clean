import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://verijob.es";
  const routes = [
    "",
    "/como-funciona",
    "/para-empresas",
    "/para-candidatos",
    "/precios",
    "/seguridad",
    "/faq",
    "/contacto",
    "/privacidad",
    "/terminos",
    "/cookies",
    "/hosteleria",
    "/retail",
    "/logistica",
    "/construccion",
  ];
  return routes.map((r) => ({ url: `${base}${r}`, lastModified: new Date() }));
}
