import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión en cada request y protege las rutas privadas.
// Endurecido: si faltan las variables de entorno o Supabase falla, NO
// tumbamos el sitio con un 500. Dejamos pasar y la página (server component)
// vuelve a validar la sesión y redirige a /login si hace falta.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const esPublica = isLogin || path.startsWith("/auth/");

  // Sin variables configuradas: no hay forma de validar sesión aquí.
  // Dejamos que la página resuelva (evita MIDDLEWARE_INVOCATION_FAILED).
  if (!url || !key) return response;

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !esPublica) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (user && isLogin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  } catch {
    // Falla transitoria de red/Supabase: no rompemos la navegación.
    return response;
  }
}

export const config = {
  // Excluye estáticos y assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
