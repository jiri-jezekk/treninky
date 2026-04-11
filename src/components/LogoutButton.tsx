import { signOutAction } from "@/actions/auth";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
      >
        Odhlásit se
      </button>
    </form>
  );
}
