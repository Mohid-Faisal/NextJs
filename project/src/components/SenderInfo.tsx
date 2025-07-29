// "use client";
// import { Card, CardContent } from "@/components/ui/card";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { FaInfoCircle } from "react-icons/fa";
// import AddCustomerDialog from "./AddCustomerDialog";

// export default function SenderInfoSection({
//   senderQuery,
//   setSenderQuery,
//   senderResults,
//   selectedSender,
//   setSelectedSender,
// }: {
//   senderQuery: string;
//   setSenderQuery: (val: string) => void;
//   senderResults: any[];
//   selectedSender: any;
//   setSelectedSender: (val: any) => void;
// }) {
//   return (
//     <Card className="bg-white border border-gray-100 shadow-sm">
//       <CardContent className="p-6">
//         {/* Header */}
//         <div className="flex items-center gap-2 mb-4">
//           <FaInfoCircle className="text-primary" />
//           <span className="font-medium">Sender Information</span>
//         </div>

//         <div className="space-y-6">
//           {/* Sender Name */}
//           <div className="flex flex-col text-black">
//             <Label className="mb-1">Sender/Customer</Label>
//             <div className="flex items-center gap-2">
//               <div className="flex-1">
//                 <Select
//                   onValueChange={(val) => {
//                     const selected = senderResults.find((s) => s.id === val);
//                     setSelectedSender(selected ?? null);
//                     setSenderQuery(selected?.Company ?? "");
//                   }}
//                 >
//                   <SelectTrigger className="w-full">
//                     <SelectValue placeholder="Search sender name..." />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <div className="px-2 py-1">
//                       <Input
//                         className="w-full text-sm"
//                         placeholder="Type to search"
//                         value={senderQuery}
//                         onChange={(e) => setSenderQuery(e.target.value)}
//                       />
//                     </div>
//                     {senderResults.length > 0 ? (
//                       senderResults.map((s) => (
//                         <SelectItem key={s.id} value={s.id}>
//                           {s.Company}
//                         </SelectItem>
//                       ))
//                     ) : (
//                       <div className="px-4 py-2 text-gray-500 text-sm">
//                         {senderQuery.length >= 2
//                           ? "No matches found."
//                           : "Type at least 2 characters"}
//                       </div>
//                     )}
//                   </SelectContent>
//                 </Select>
//               </div>
//               <AddCustomerDialog triggerLabel="+" />
//             </div>
//           </div>

//           {/* Sender Address */}
//           <div className="flex flex-col text-black">
//             <Label className="mb-1">Sender/Customer Address</Label>
//             <div className="flex gap-2">
//               <Input
//                 value={selectedSender?.Address ?? ""}
//                 readOnly
//                 placeholder="Sender address"
//                 className="flex-1 bg-gray-100"
//               />
//               <AddCustomerDialog triggerLabel="+" />
//             </div>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
