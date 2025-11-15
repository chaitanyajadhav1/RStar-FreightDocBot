"use client"

import dynamic from "next/dynamic"
// import PDFExtractor from './components/PDFExtractor';

const FreightChatProIntegrated = dynamic(() => import("./components/freight-chat-pro"), { ssr: false })

export default function FreightPage() {
  return <FreightChatProIntegrated />
}


// export default function Home() {
//   return (
//     <main>
//       <PDFExtractor />
//     </main>
//   );
// }