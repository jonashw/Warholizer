import { Config, Context } from "@netlify/functions";
import { withAuthenticatedGoogleUser } from "./auth.mts";
import {db,sql} from "../db";
import { uploads } from "../db/schema";

export default async (req: Request, context: Context): Promise<Response> => {
    //return withAuthenticatedGoogleUser(req, async (user) => {
        const id = context.params?.id;
        if(!id) {
            return Response.json({error: 'Missing file id'});
        }
        const [upload] = await sql`SELECT file_name, type, base64_encoded_data FROM uploads WHERE id = ${id}`;
        if(!upload) {
            return Response.json({error: 'File not found'});
        }
        //return Response.json(upload);
        const buffer = Buffer.from(upload.base64_encoded_data, 'base64');
        
        return new Response(
            buffer,
            {headers: {
                'Content-Type': upload.type,
                'Content-Length': buffer.length.toString(),
                'Content-Disposition': `inline; filename="${upload.file_name}"`
            }});
    //})
};

export const config: Config = {
  path: "/api/upload/:id"
};