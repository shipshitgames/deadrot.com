import { SignUp } from "@clerk/nextjs";

import { Backdrop } from "@/components/site/atmosphere";
import { authEnabled } from "@/lib/access";

export const metadata = { title: "Enlist" };

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 pt-24 pb-16">
      <Backdrop />
      <div className="relative z-10">
        {authEnabled ? (
          <SignUp />
        ) : (
          <p className="font-display uppercase tracking-widest text-ash">Sign-up is not configured yet.</p>
        )}
      </div>
    </main>
  );
}
