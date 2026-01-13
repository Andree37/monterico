import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user?.password) {
                    return null;
                }

                const isValidPassword = await bcrypt.compare(
                    credentials.password as string,
                    user.password,
                );

                if (!isValidPassword) {
                    return null;
                }

                return {
                    id: user.id,
                    email: user.email,
                    mfaSetupComplete: user.mfaSetupComplete,
                    mfaRequired: user.mfaRequired,
                };
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                token.mfaSetupComplete = user.mfaSetupComplete;
                token.mfaRequired = user.mfaRequired;
                token.mfaVerified = false;
                token.bankOperationMfaVerifiedAt = null;
            }

            // Handle session updates from client
            if (trigger === "update" && session) {
                if (session.user?.mfaSetupComplete !== undefined) {
                    token.mfaSetupComplete = session.user.mfaSetupComplete;
                }
                if (session.user?.mfaVerified !== undefined) {
                    token.mfaVerified = session.user.mfaVerified;
                }
                if (session.user?.bankOperationMfaVerifiedAt !== undefined) {
                    token.bankOperationMfaVerifiedAt =
                        session.user.bankOperationMfaVerifiedAt;
                }
            }

            // Refresh user data from database when session is updated
            if (trigger === "update" && !session && token.id) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: {
                        id: true,
                        email: true,
                        mfaSetupComplete: true,
                        mfaRequired: true,
                    },
                });

                if (dbUser) {
                    token.mfaSetupComplete = dbUser.mfaSetupComplete;
                    token.mfaRequired = dbUser.mfaRequired;
                    // Mark as verified after successful setup
                    if (dbUser.mfaSetupComplete) {
                        token.mfaVerified = true;
                    }
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string;
                session.user.mfaSetupComplete =
                    token.mfaSetupComplete as boolean;
                session.user.mfaRequired = token.mfaRequired as boolean;
                session.user.mfaVerified = token.mfaVerified as boolean;
                session.user.bankOperationMfaVerifiedAt =
                    token.bankOperationMfaVerifiedAt as number | null;
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
});
