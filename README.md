# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## AI Coach backend (human-like chat)

The app can run in two modes:

- `fallback` (local rule-based replies)
- `remote` (real LLM conversation)

To get real conversational responses, run the included proxy server and connect it from Expo env.

1. Start backend proxy

```bash
OPENAI_API_KEY=your_key_here npm run ai:chat-server
```

Optional:

```bash
OPENAI_MODEL=gpt-4.1-mini PORT=8787 OPENAI_API_KEY=your_key_here npm run ai:chat-server
```

2. Point app to backend

Add in your Expo env:

```bash
EXPO_PUBLIC_AI_CHAT_URL=http://localhost:8787/ai-chat
```

3. Restart Expo (`npm start`) so env changes apply.

Notes:

- On a physical phone, `localhost` means the phone itself. Use your computer LAN IP instead, e.g. `http://192.168.1.50:8787/ai-chat`.
- Keep `OPENAI_API_KEY` only on backend/server side. Do not put it in Expo public env.
