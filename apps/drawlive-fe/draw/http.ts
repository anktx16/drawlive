import axios from "axios";

function getAuthHeader(): string {
    if (typeof window === "undefined") return ""; // guards against server-side execution
    const token = localStorage.getItem("token");
    return token ? token : "";
}

export async function getExistingShapes(slug: string) {
    const response = await axios.get(`${process.env.NEXT_PUBLIC_HTTP_URL}/chats/${slug}`, {
        headers: {
            Authorization: getAuthHeader()
        }
    })
    const messages = response.data.chats;

    const shapes = messages.flatMap((x: { message: string }) => {
        try {
            const messageData = JSON.parse(x.message);
            return messageData.shape ? [messageData.shape] : [];
        } catch {
            return [];
        }
    });

    return shapes;
}

export const getRoomId = async (slug: string) => {
    const response = await axios.get(`${process.env.NEXT_PUBLIC_HTTP_URL}/room/${slug}`, {
        headers: {
            Authorization: getAuthHeader()
        }
    })
    return response.data.roomId
}
