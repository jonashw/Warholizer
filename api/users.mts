import { Config } from "@netlify/functions";
import { db } from "../db";
import { withAuthenticatedAdmin } from "./auth.mts";

// Lists every user and sign-in, so it is restricted to admins (see ADMIN_EMAILS).
export default async (req: Request) =>
    withAuthenticatedAdmin(req, async () => {
        const users = (await db.query.users.findMany({with: {signins: true}}));
        const signins = await db.query.user_signins.findMany();
        return new Response(JSON.stringify({users,signins}),{headers: {'Content-Type': 'application/json'}});
    });

export const config: Config = {
  path: "/api/users"
};
