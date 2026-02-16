import { Config } from "@netlify/functions";
import { withAuthenticatedGoogleUser } from "./auth.mts";
import {db,sql} from "../db";
import { uploads } from "../db/schema";

const json = (o: any) => 
    new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });

export default async (req: Request) => 
    withAuthenticatedGoogleUser(req, async (user) => {
        /*
        const blob = await req.blob();
        const contentDisposition = req.headers.get('Content-Disposition');
        const fileNameMatch = contentDisposition?.match(/filename="(.+)"/);
        const file_name = !!fileNameMatch && fileNameMatch.length > 1 ? fileNameMatch[1] : 'unknown';
        const data = Buffer.from(await blob.arrayBuffer()).toString('base64');
        const mime_type = blob.type
        */
        const formData = await req.formData();
        const file_name = formData.get('file_name');
        const file_type = formData.get('file_type');
        const data = formData.get('base64_encoded_data') as string;
        if(!data || !file_name || !file_type) {
            return json({error: 'Missing required fields: base64_encoded_data, file_name, file_type'});
        }

        const id = crypto.randomUUID();

        await sql`INSERT INTO uploads 
            (id, user_id, file_name, type, base64_encoded_data) 
            VALUES (
                ${id}, ${user.id}, ${file_name}, ${file_type}, ${data}
            )`;
        /*
        await db.insert(uploads).values({
            id,
            user_id: user.id,
            file_name,
            bytes: Buffer.from(buffer)
        });
        */

        return json({
            status:'ok',
            file_id: id
        });
    });

export const config: Config = {
  path: "/api/upload"
};