import RoomCanvas from "@/components/RoomCanvas";
import { getRoomId } from "@/draw/http";

export default async function CanvasPage({ params }: { params: { slug: string }}) {
   const slug = (await params).slug;
   const roomId = await getRoomId(slug)

   return <div className="bg-black h-screen">
      <RoomCanvas slug={slug} roomId={roomId}/>
   </div>
}
