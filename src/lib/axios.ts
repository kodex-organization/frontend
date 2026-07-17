import axios from "axios";


const api = axios.create({

  baseURL:
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000/api/v1",

  headers: {
    "Content-Type": "application/json",
  },

});



// Add token automatically
api.interceptors.request.use(
  (config) => {

    const token =
      localStorage.getItem("token");


    if (token) {

      config.headers.Authorization =
        `Bearer ${token}`;

    }


    return config;

  },

  (error) => {

    return Promise.reject(error);

  }
);



export default api;