// src/auth-options.ts
import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const hasFacebook =
  !!process.env.FACEBOOK_CLIENT_ID && !!process.env.FACEBOOK_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  // ✅ stabilnie w dev, brak DB-session loop
  session: { strategy: "jwt" },

  pages: {
    signIn: "/auth",
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),

    // ✅ Facebook – ważne: scope z emailem
    ...(hasFacebook
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID ?? "",
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? "",
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope: "public_profile,email",
              },
            },
          }),
        ]
      : []),

    CredentialsProvider({
      name: "Email i hasło",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Hasło", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id;
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};