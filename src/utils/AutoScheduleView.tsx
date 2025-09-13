// import { ScheduledBlock } from "@/utils/generateAutoSchedule"
// import { formatClock } from "@/utils/generateAutoSchedule"
// import { cn } from "@/lib/utils"

// interface AutoScheduleViewProps {
//   schedule: ScheduledBlock[]
//   use12HourClock?: boolean
//   recurringBlocks: {
//     title: string
//     times: string[]
//     duration: number
//   }[]
//   setRecurringBlocks: (blocks: AutoScheduleViewProps["recurringBlocks"]) => void
//   tasks: {
//     id: string
//     title: string
//     priority?: "low" | "medium" | "high"
//   }[]
// }

// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { useState } from "react"

// const AutoScheduleView = ({
//   schedule,
//   use12HourClock = false,
//   recurringBlocks,
//   setRecurringBlocks,
//   tasks,
// }: AutoScheduleViewProps) => {
//   const [showDialog, setShowDialog] = useState(false)
//   const [toDelete, setToDelete] = useState<string | null>(null)

//   const confirmDelete = (title: string) => {
//     setToDelete(title)
//     setShowDialog(true)
//   }

//   const handleDelete = () => {
//     if (!toDelete) return
//     const updated = recurringBlocks.filter(block => block.title !== toDelete)
//     setRecurringBlocks(updated)
//     localStorage.setItem("recurringBlocks", JSON.stringify(updated))
//     setToDelete(null)
//     setShowDialog(false)
//   }

//   const getPriorityColor = (block: ScheduledBlock) => {
//     const task = tasks.find(t => t.id === block.taskId)
//     const priority = task?.priority ?? "medium"

//     if (priority === "high") return "bg-red-100"
//     if (priority === "low") return "bg-blue-100"
//     return "bg-orange-100"
//   }

//   return (
//     <>
//       <div className="space-y-4 divide-y divide-border">
//         {schedule.map((block, index) => (
//           <div
//             key={index}
//             className={cn(
//               "flex items-start space-x-4 pt-2 rounded-md px-2 py-1",
//               block.title === "Sleep" && "bg-gray-300",
//               (block.type === "fixed" ||
//                 recurringBlocks.some(rb => rb.title === block.title)) &&
//                 "bg-blue-100/40",
//               (block.title === "Free Time" || block.type === "break") &&
//                 "bg-pink-100/40",
//               block.type === "task" && getPriorityColor(block)
//             )}
//           >
//             <div className="w-36 min-w-[9rem] text-sm font-medium text-muted-foreground">
//               {block.start} – {block.end}
//             </div>

//             <div className="flex-1">
//               <div className="text-base font-semibold">{block.title}</div>
//             </div>

//             {block.type === "fixed" &&
//               recurringBlocks.some(rb => rb.title === block.title) && (
//                 <Button
//                   variant="ghost"
//                   className="text-red-500 hover:underline"
//                   onClick={() => confirmDelete(block.title)}
//                 >
//                   Delete
//                 </Button>
//               )}
//           </div>
//         ))}
//       </div>

//       <Dialog open={showDialog} onOpenChange={setShowDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Are you sure?</DialogTitle>
//           </DialogHeader>
//           <p>This will permanently remove the recurring task.</p>
//           <DialogFooter>
//             <Button variant="ghost" onClick={() => setShowDialog(false)}>
//               Cancel
//             </Button>
//             <Button variant="destructive" onClick={handleDelete}>
//               Delete
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </>
//   )
// }

// export default AutoScheduleView
