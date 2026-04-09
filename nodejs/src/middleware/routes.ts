import Router from"@koa/router";
import { getCommentBySlug, postComment } from "../api/index" // public
import { getAllComments, changeCommentStatus, login } from "../api/index" // admin
import { getUserData, getPlaylistSongs, getPublicUserData, getPublicPlaylistSongs, getCookieUserData, getCookiePlaylistSongs, getTrack } from "../api/index" // music
import fs from "fs";
import path from "path";


const router = new Router();

router.get("/api/comments", getCommentBySlug);
router.post("/api/comments", postComment);

router.get("/admin/comments/list", getAllComments);
router.put("/admin/comments/status", changeCommentStatus);
router.post("/admin/login", login);

router.get("/api/music/user", getUserData);
router.get("/api/music/playlist-songs", getPlaylistSongs);
router.get("/api/music/public-user", getPublicUserData);
router.get("/api/music/public-playlist-songs", getPublicPlaylistSongs);
router.get("/api/music/cookie-user", getCookieUserData);
router.get("/api/music/cookie-playlist-songs", getCookiePlaylistSongs);
router.get("/api/music/track", getTrack);

router.get("/*all", async (ctx) => {
  ctx.type = "text/html";
  ctx.body = fs.createReadStream(path.join(__dirname, "../../public/index.html"));
});

export default router;