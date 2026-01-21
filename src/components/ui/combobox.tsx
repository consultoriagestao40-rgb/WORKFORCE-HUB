"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
    options: { value: string; label: string }[]
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = "Select option...",
    searchPlaceholder = "Search...",
    emptyMessage = "No results found.",
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    // Filter options based on search
    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value
                        ? options.find((option) => option.value === value)?.label
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <div className="p-2 border-b">
                    <input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="max-h-[200px] overflow-y-auto p-1">
                    {filteredOptions.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
                    ) : (
                        filteredOptions.map((option) => (
                            <div
                                key={option.value}
                                className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                    value === option.value ? "bg-accent text-accent-foreground" : ""
                                )}
                                onClick={() => {
                                    onChange(option.value)
                                    setOpen(false)
                                    setSearch("")
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === option.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {option.label}
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
