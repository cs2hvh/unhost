"use client"

import { useId, useState } from "react"
import { RefreshCw } from "lucide-react"

import { cn, generateToken } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export default function AuthInput({
    value,
    onChange
}: {
    value: string
    onChange: (value: string) => void
}) {
    const id = useId()
    const [regenerate, setRegenerated] = useState<boolean>(false)

    const handleRefresh = () => {
        const newToken = generateToken()
        onChange(newToken)
        setRegenerated(true)
        setTimeout(() => setRegenerated(false), 300)
    }

    return (
        <div className="space-y-2">
            <div className="relative group">
                <Input
                    id={id}
                    className="pe-11 h-11 font-mono text-sm"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Enter your authentication token"
                />
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleRefresh}
                                className="text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-11 items-center justify-center rounded-e-md transition-all outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed"
                                aria-label={regenerate ? "Regenerated" : "Regenerate authentication token"}
                                disabled={regenerate}
                            >
                                <div
                                    className={cn(
                                        "transition-all",
                                        regenerate ? "scale-100 opacity-100" : "scale-0 opacity-0"
                                    )}
                                >
                                    <RefreshCw
                                        className="animate-spin"
                                        size={16}
                                        aria-hidden="true"
                                    />
                                </div>
                                <div
                                    className={cn(
                                        "absolute transition-all",
                                        regenerate ? "scale-0 opacity-0" : "scale-100 opacity-100"
                                    )}
                                >
                                    <RefreshCw size={16} aria-hidden="true" />
                                </div>
                            </button>
                        </TooltipTrigger>
                        <TooltipContent className="px-2 py-1 text-xs">
                            Regenerate authentication token
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    )
}
