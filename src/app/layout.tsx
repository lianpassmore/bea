import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Lora, DM_Sans } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase-server";
import { getCurrentMember } from "@/lib/auth";
import HeaderBar from "@/components/header-bar";
import FooterBar from "@/components/footer-bar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans"
});

export const metadata: Metadata = {
  title: "Bea",
  description: "A quiet presence in the life of a family.", // Updated to match positioning
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isFullViewport = pathname.startsWith("/audit");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPrimary = false;
  let memberId: string | null = null;
  let memberName: string | null = null;
  let avatarUrl: string | null = null;
  type NotifRow = {
    id: string;
    briefing: string;
    crisis_level: 'concerned' | 'urgent';
    created_at: string;
    affected: { name: string } | { name: string }[] | null;
  };
  let notifications: {
    id: string;
    briefing: string;
    crisis_level: 'concerned' | 'urgent';
    created_at: string;
    affected_member_name: string;
  }[] = [];

  if (user) {
    const member = await getCurrentMember();
    if (member) {
      isPrimary = member.role === "primary";
      memberId = member.id;
      memberName = member.name;
      avatarUrl = member.avatar_url;
      const { data } = await supabase
        .from("crisis_notifications")
        .select(
          `id, briefing, crisis_level, created_at,
           affected:members!affected_member_id(name)`
        )
        .eq("contact_member_id", member.id)
        .is("seen_at", null)
        .order("created_at", { ascending: false });
      notifications = ((data ?? []) as unknown as NotifRow[]).map((n) => {
        const affectedName = Array.isArray(n.affected)
          ? n.affected[0]?.name
          : n.affected?.name;
        return {
          id: n.id,
          briefing: n.briefing,
          crisis_level: n.crisis_level,
          created_at: n.created_at,
          affected_member_name: affectedName ?? "A family member",
        };
      });
    }
  }

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${lora.variable} ${dmSans.variable} font-body bg-bea-milk text-bea-charcoal antialiased min-h-screen selection:bg-bea-amber selection:text-bea-milk`}
      >
        {isFullViewport ? (
          // Full-viewport routes (e.g. /audit) render their own chrome and
          // span the whole screen — no max-w container, no header/footer bars.
          children
        ) : (
          <>
            {/* pb-28 leaves room for the fixed footer tab bar */}
            <main className="max-w-md mx-auto min-h-screen p-8 pb-28 flex flex-col relative">

              {user && (
                <HeaderBar
                  memberId={memberId}
                  memberName={memberName}
                  avatarUrl={avatarUrl}
                  notifications={notifications}
                />
              )}

              <div className="flex-1 animate-fade-in flex flex-col">
                {children}
              </div>

            </main>

            {user && <FooterBar isPrimary={isPrimary} />}
          </>
        )}
      </body>
    </html>
  );
}