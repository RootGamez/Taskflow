import * as React from "react"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/shadcn/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  formatters,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      formatters={{
        formatCaption: (date, options) => {
          const caption = format(date, "LLLL yyyy", { locale: options?.locale })
          return caption.charAt(0).toUpperCase() + caption.slice(1)
        },
        ...formatters,
      }}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2 relative",
        month: "space-y-4 w-fit",
        month_caption: "flex justify-center pt-1 relative items-center h-9 w-full overflow-visible",
        caption_label: "text-sm font-medium",
        nav: "flex items-center pointer-events-none",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-0 top-1/2 -translate-x-[115%] -translate-y-1/2 h-7 w-7 bg-background p-0 opacity-70 hover:opacity-100 pointer-events-auto dark:border-zinc-800"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-0 top-1/2 translate-x-[115%] -translate-y-1/2 h-7 w-7 bg-background p-0 opacity-70 hover:opacity-100 pointer-events-auto dark:border-zinc-800"
        ),
        month_grid: "border-collapse mx-auto tabular-nums",
        weekdays: "flex",
        weekday: "text-zinc-500 rounded-md w-8 font-normal text-[0.75rem] dark:text-zinc-400 text-center",
        week: "flex w-full mt-1",
        day: "h-8 w-8 text-center text-sm p-0 flex justify-center items-center",
        day_button: "h-full w-full p-0 font-normal aria-selected:opacity-100 m-0 text-center inline-flex items-center justify-center hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-colors rounded-md",
        range_end: "day-range-end",
        selected:
          "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 hover:text-zinc-50 focus:bg-zinc-900 focus:text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50 dark:hover:text-zinc-900 rounded-md",
        today: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50 rounded-md",
        outside:
          "day-outside text-zinc-500 aria-selected:bg-zinc-100/50 aria-selected:text-zinc-500 aria-selected:opacity-30 dark:text-zinc-400 dark:aria-selected:bg-zinc-800/50 dark:aria-selected:text-zinc-400",
        disabled: "text-zinc-500 opacity-50 dark:text-zinc-400",
        range_middle:
          "aria-selected:bg-zinc-100 aria-selected:text-zinc-900 dark:aria-selected:bg-zinc-800 dark:aria-selected:text-zinc-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className, ...props }) => {
          if (props.orientation === 'left') {
            return <ChevronLeft className={cn("h-4 w-4", className)} />
          }
          return <ChevronRight className={cn("h-4 w-4", className)} />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
