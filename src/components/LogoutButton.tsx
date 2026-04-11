import { signOutAction } from "@/actions/auth";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Odhlásit se
      </button>
    </form>
  );
}
