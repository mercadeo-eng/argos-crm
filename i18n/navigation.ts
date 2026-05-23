import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

// Wrappers locale-aware sobre next/link y next/navigation. Usar en
// componentes para que las URLs preserven el locale activo.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
