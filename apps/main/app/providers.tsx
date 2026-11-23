"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@repo/ui/components/themeprovider"
import { TooltipProvider } from "@repo/ui/components/ui/tooltip"
import { Toaster } from "@repo/ui/components/ui/toast"

/**
 * The app's client providers: ONE QueryClient (AGENTS.md section 11 defaults), the theme, one tooltip provider and ONE
 * toaster (top-right).
 */
function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60_000,
                gcTime: 5 * 60_000,
                refetchOnWindowFocus: false,
                retry: 1,
            },
        },
    })
}

export function Providers({ children }: { children: React.ReactNode }) {
    // One client per browser tab, created once (useState, not module scope, so the server never shares one).
    const [queryClient] = React.useState(makeQueryClient)
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <TooltipProvider delayDuration={250}>
                    {children}
                    <Toaster position="top-right" />
                </TooltipProvider>
            </ThemeProvider>
        </QueryClientProvider>
    )
}
