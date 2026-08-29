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
          "absolute left-0 top-1/2 -translate-x-[115%] -translate-y-1/2 h-7 w-7 bg-background p-0 opacity-70 hover:opacity-100 pointer-events-auto"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-0 top-1/2 translate-x-[115%] -translate-y-1/2 h-7 w-7 bg-background p-0 opacity-70 hover:opacity-100 pointer-events-auto"
        ),
        month_grid: "border-collapse mx-auto tabular-nums",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.75rem] text-center",
        week: "flex w-full mt-1",
        day: "h-8 w-8 text-center text-sm p-0 flex justify-center items-center",
        day_button: "h-full w-full p-0 font-normal aria-selected:opacity-100 m-0 text-center inline-flex items-center justify-center hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent dark:hover:text-accent-foreground transition-colors rounded-md",
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary dark:hover:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground rounded-md",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-muted aria-selected:text-muted-foreground aria-selected:opacity-30 dark:text-muted-foreground dark:aria-selected:bg-muted dark:aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground dark:aria-selected:bg-accent dark:aria-selected:text-accent-foreground",
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
