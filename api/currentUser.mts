import type { Config } from "@netlify/functions"
import { OAuth2Client } from 'google-auth-library';
import {withAuthenticatedGoogleUser} from "./auth.mjs";
export const clientId = process.env.VITE_GOOGLE_AUTH_CLIENT_ID;
export const client = new OAuth2Client();

export default async (req: Request) => 
    withAuthenticatedGoogleUser(req, async (user) => 
        new Response(JSON.stringify({user}),{headers: {'Content-Type': 'application/json'}}));

export const config: Config = {
  path: "/api/current-user"
};