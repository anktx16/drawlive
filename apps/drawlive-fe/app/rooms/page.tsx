"use client"

import axios from "axios"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useProtectedRoute } from "@/hooks/useProtectedRoute"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

type Room = {
    id: number;
    slug: string;
    createdAt: string;
}

const Page = () => {
    useProtectedRoute();
    const router = useRouter();
    const [rooms, setRooms] = useState<Room[]>([])
    const [loading, setLoading] = useState(true)

    const [modalOpen, setModalOpen] = useState(false)
    const [slug, setSlug] = useState("")
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        async function fetchRooms() {
            try {
                const res = await axios.get(`${process.env.NEXT_PUBLIC_HTTP_URL}/rooms`)
                setRooms(res.data.response)
            } catch {
                setError("Failed to load rooms")
            } finally {
                setLoading(false)
            }
        }
        fetchRooms()
    }, [])

    function openModal() {
        setSlug("")
        setError("")
        setModalOpen(true)
    }

    function closeModal() {
        if (creating) return // don't let a click-away dismiss mid-request
        setModalOpen(false)
        setError("")
    }

    async function handleCreateRoom() {
        const trimmed = slug.trim()
        if (!trimmed) {
            setError("Please enter a room name")
            return
        }

        setCreating(true)
        setError("")

        try {
            const token = localStorage.getItem("token")
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_HTTP_URL}/room`,
                { slug: trimmed },
                { headers: { Authorization: token ?? "" } }
            )

            setModalOpen(false)
            router.push(`/canvas/${res.data.roomName}`)
        } catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.message ?? "Something went wrong")
            } else {
                setError("Something went wrong")
            }
        } finally {
            setCreating(false)
        }
    }

    return (
        <>
        <div
            className="min-h-screen bg-black text-white"
            style={{
                backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
            }}
            >
            <Navbar/>
            <div className="max-w-3xl mx-auto px-8 py-16">
                {/* Header */}
                <div className="flex items-end justify-between border-b border-white/15 pb-6 mb-10">
                    <div>
                        <Link href="/" className="text-xs font-mono text-white/40 hover:text-white transition-colors">
                            drawlive
                        </Link>
                        <h1 className="text-4xl font-semibold tracking-tight mt-2">
                            Rooms
                        </h1>
                    </div>
                    <div className="flex items-center gap-5">
                        <p className="text-sm text-white/40 font-mono">
                            {loading ? "—" : `${rooms.length} active`}
                        </p>
                        <button
                            onClick={openModal}
                            className="bg-white text-black rounded-md px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors"
                        >
                            Create room
                        </button>
                    </div>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col gap-3">
                        {[...Array(3)].map((_, i) => (
                            <div
                                key={i}
                                className="h-[72px] border border-white/10 rounded-sm animate-pulse"
                            />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && rooms.length === 0 && (
                    <div className="border border-dashed border-white/20 rounded-sm py-20 text-center">
                        <p className="text-white/50 mb-1">Nothing drawn yet.</p>
                        <p className="text-white/30 text-sm">
                            Create a room to open a blank canvas.
                        </p>
                    </div>
                )}

                {/* Room list */}
                {!loading && rooms.length > 0 && (
                    <ul className="flex flex-col gap-3">
                        {rooms.map((room) => (
                            <li
                                key={room.id}
                                className="group relative border border-white/15 rounded-sm px-5 py-4 flex items-center justify-between transition-colors duration-150 hover:border-white/40 hover:bg-white/[0.03]"
                            >
                                <span className="pointer-events-none absolute -top-px -left-px w-3 h-3 border-t border-l border-transparent group-hover:border-white transition-colors duration-150" />
                                <span className="pointer-events-none absolute -top-px -right-px w-3 h-3 border-t border-r border-transparent group-hover:border-white transition-colors duration-150" />
                                <span className="pointer-events-none absolute -bottom-px -left-px w-3 h-3 border-b border-l border-transparent group-hover:border-white transition-colors duration-150" />
                                <span className="pointer-events-none absolute -bottom-px -right-px w-3 h-3 border-b border-r border-transparent group-hover:border-white transition-colors duration-150" />

                                <div className="flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                    <div className="flex flex-col">
                                        <span className="font-mono text-base">{room.slug}</span>
                                        <span className="text-xs text-white/40 font-mono">
                                            {new Date(room.createdAt).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => router.push(`/canvas/${room.slug}`)}
                                    className="border border-white/30 rounded-md px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition-colors duration-150"
                                >
                                    Join room
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Create room modal */}
            {modalOpen && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center px-6 z-50"
                    onClick={closeModal}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm border border-white/15 rounded-sm p-8 bg-black"
                        style={{
                            backgroundImage:
                                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                            backgroundSize: "32px 32px",
                        }}
                    >
                        <span className="pointer-events-none absolute -top-px -left-px w-4 h-4 border-t border-l border-white/40" />
                        <span className="pointer-events-none absolute -top-px -right-px w-4 h-4 border-t border-r border-white/40" />
                        <span className="pointer-events-none absolute -bottom-px -left-px w-4 h-4 border-b border-l border-white/40" />
                        <span className="pointer-events-none absolute -bottom-px -right-px w-4 h-4 border-b border-r border-white/40" />

                        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">
                            new canvas
                        </p>
                        <h2 className="text-xl font-semibold tracking-tight mb-6">
                            Create a room
                        </h2>

                        <div className="flex flex-col gap-1.5 mb-2">
                            <label className="text-xs font-mono text-white/40">slug</label>
                            <input
                                autoFocus
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCreateRoom()
                                }}
                                placeholder="my-room"
                                className="bg-white/5 border border-white/15 rounded-md px-4 py-2.5 text-sm font-mono outline-none focus:border-white/40 transition-colors placeholder:text-white/25"
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 text-sm mt-2 font-mono">{error}</p>
                        )}

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={closeModal}
                                disabled={creating}
                                className="flex-1 border border-white/20 rounded-md py-2.5 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRoom}
                                disabled={creating}
                                className="flex-1 bg-white text-black rounded-md py-2.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {creating ? "Creating..." : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        <Footer/>
        </div>
    </>
    )
}

export default Page
