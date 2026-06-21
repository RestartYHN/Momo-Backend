import Router from"@koa/router";
import { getCommentBySlug, postComment } from "../api/index" // public
import { getAllComments, changeCommentStatus, login, getStatsOverview, getUserList, getUserComments, getSettings, updateSettings, changePassword, testEmail, importComments, importSettings, exportSettings, exportComments } from "../api/index" // admin
import { getUserData, getPlaylistSongs, getPublicUserData, getPublicPlaylistSongs, getCookieUserData, getCookiePlaylistSongs, getTrack, getPodcastPrograms, getPodcastProgramDetail, getUserRecord, getUserAlbums, getAlbum, searchSongs } from "../api/index" // music
import fs from "fs";
import path from "path";


const router = new Router();

router.get("/api/comments", getCommentBySlug);
router.post("/api/comments", postComment);

router.get("/admin/settings", getSettings);
router.put("/admin/settings", updateSettings);
router.post("/admin/settings/test-email", testEmail);
router.put("/admin/password", changePassword);

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
router.get("/api/music/podcast/programs", getPodcastPrograms);
router.get("/api/music/podcast/detail", getPodcastProgramDetail);
router.get("/api/music/record", getUserRecord);
router.get("/api/music/albums", getUserAlbums);
router.get("/api/music/album", getAlbum);
router.get("/api/music/search", searchSongs);

router.get("/admin/stats/overview", getStatsOverview);
router.get("/admin/stats/users", getUserList);
router.get("/admin/stats/users/comments", getUserComments);

router.post("/admin/data/import/comments", importComments);
router.post("/admin/data/import/settings", importSettings);
router.get("/admin/data/export/settings", exportSettings);
router.get("/admin/data/export/comments", exportComments);

router.get("/*all", async (ctx) => {
  ctx.type = "text/html";
  ctx.body = fs.createReadStream(path.join(__dirname, "../../public/index.html"));
});

export default router;