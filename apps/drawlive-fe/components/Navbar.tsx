"use client"

import { useAuth } from "@/app/context/AuthContext"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"



const Navbar = () => {
    const { logout, isAuthenticated } = useAuth()
    const router = useRouter()

    function handleLogOut() {
        logout();
        router.push("/");
    }
  return (
    <nav className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
                <span className="font-mono text-sm tracking-tight">drawlive</span>
                <div className="flex items-center gap-6 text-sm">
                    <button onClick={() => router.push("/rooms")} className="text-white/60 hover:text-white transition-colors">
                        Rooms
                    </button>
                    {isAuthenticated ? (
                        <button
                            onClick={handleLogOut}
                            title="Log out"
                            className="inline-flex items-center gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-red-200 hover:border-red-400/60 hover:bg-red-500/20 hover:text-white transition-colors cursor-pointer"
                        >
                            <LogOut size={15} />
                            <span>Log out</span>
                        </button>
                    ) : (
                        <>
                        <button onClick={() => router.push("/signin")} className="text-white/60 hover:text-white transition-colors">
                            Sign in
                        </button>

                        <button
                            onClick={() => router.push("/signup")}
                            className="border border-white/30 rounded-md px-4 py-1.5 hover:bg-white hover:text-black transition-colors duration-150"
                        >
                            Get started
                        </button>
                        </>
                    )}
                    
                </div>
            </nav>
  )
}

export default Navbar
