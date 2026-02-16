import type { Config } from "@netlify/functions"
import { OAuth2Client } from 'google-auth-library';
import { neon } from '@netlify/neon';
import { db } from "../db";
import { user_signins, users } from "../db/schema";

const clientId = process.env.VITE_GOOGLE_AUTH_CLIENT_ID;
const client = new OAuth2Client();

export type User = {
    id: string,
    name: string,
    email: string
    picture: string
};

const tryGetUserFromTicket = (ticket: any): User|string => {
    const payload = ticket.getPayload();
    if(!payload) {
        return 'Invalid token payload';
    }
    const email = payload.email;
    if(!email) {
        return 'Email not found in token payload'
    }
    const picture = payload.picture;
    if(!picture) {
        return 'Picture not found in token payload';
    }
    const name = payload.name;
    if(!name) {
        return 'Name not found in token payload';
    }
    const user: User = {
        id: payload.sub,
        name,
        email,
        picture
    }
    return user;
};

export async function withAuthenticatedGoogleUser(req: Request, next: (user: any) => Promise<Response>) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), { headers: { 'Content-Type': 'application/json' }, status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: clientId,
        // Or, if multiple clients access the backend:
        //[WEB_CLIENT_ID_1, WEB_CLIENT_ID_2, WEB_CLIENT_ID_3]
    });
    var user = tryGetUserFromTicket(ticket);
    if (user instanceof String) {
        return new Response(JSON.stringify({ error: user }), { headers: { 'Content-Type': 'application/json' }, status: 401 });
    }
    return next(user);
}

export default async (req: Request) => {
    const body = await req.formData();
    const token = body.get('id_token');
    if(typeof token !== 'string') {
        return new Response(JSON.stringify({error: 'Expected code in request body'}),{headers: {'Content-Type': 'application/json'}, status: 400});
    }
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: clientId,  
        // Or, if multiple clients access the backend:
        //[WEB_CLIENT_ID_1, WEB_CLIENT_ID_2, WEB_CLIENT_ID_3]
    });
    var user = tryGetUserFromTicket(ticket);
    if(typeof user === "string") {
        console.log(user);
        return new Response(JSON.stringify({error: user}),{headers: {'Content-Type': 'application/json'}, status: 401});
    }
    const u: User = user;

    await db
    .insert(users)
    .values(u)
    .onConflictDoNothing();

    await db
    .insert(user_signins)
    .values({user_id: u.id});

    return new Response(JSON.stringify(user),{headers: {'Content-Type': 'application/json'}});
}

export const config: Config = {
  path: "/api/auth"
};