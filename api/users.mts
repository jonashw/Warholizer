import { Config } from "@netlify/functions";
import { db } from "../db";

export default async () => {
    const users = (await db.query.users.findMany({with: {signins: true}}));
    const signins = await db.query.user_signins.findMany();
    return new Response(JSON.stringify({users,signins}),{headers: {'Content-Type': 'application/json'}});
}

export const config: Config = {
  path: "/api/users"
};