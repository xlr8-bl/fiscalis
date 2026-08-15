import { onRequestPost as __api_book_js_onRequestPost } from "/home/user/fiscalis/functions/api/book.js"
import { onRequest as __api_book_js_onRequest } from "/home/user/fiscalis/functions/api/book.js"

export const routes = [
    {
      routePath: "/api/book",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_book_js_onRequestPost],
    },
  {
      routePath: "/api/book",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_book_js_onRequest],
    },
  ]