import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        let user = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            user = await prisma.user.findUnique({ where: { email } });
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.username || user.name,
          username: user.username ?? undefined,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      if (user?.username) token.username = user.username;
      if (user?.role) token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.username) session.user.username = token.username as string;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
  },
});
