export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#09090b] text-white">
      <div className="text-center space-y-4 max-w-md p-6 border border-zinc-800 rounded-lg">
        <h1 className="text-3xl font-bold text-red-500">Access Denied</h1>
        <p className="text-zinc-400 text-sm">
          You do not have permission to access the Opta Admin Dashboard.
          <br />
          Ensure you are signed into an authorized admin account.
        </p>
        <div className="pt-4">
          <a
            href="http://localhost:3002/login"
            className="inline-block px-4 py-2 bg-white text-black font-medium rounded hover:bg-zinc-200 transition-colors"
          >
            Sign in via Accounts
          </a>
        </div>
      </div>
    </div>
  );
}
