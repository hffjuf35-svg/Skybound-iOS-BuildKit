# Skybound — iOS build kit

This folder turns the web game into a **real iOS app package (IPA)**.
The actual build must run on macOS/Xcode, so we use GitHub's free `macos-14` runner.

## Steps

1. Create a new GitHub repository and upload **this whole folder** (including the hidden
   `.github` folder and the `www/` folder).
2. Go to the repository → **Actions** → enable workflows if asked.
3. Run the workflow: **Actions → Build Skybound unsigned IPA → Run workflow**.
   (It also runs automatically on every push to `main`.)
4. When the job finishes, download the artifact **Skybound-unsigned-ipa** from the run page.
5. Unzip the artifact — inside is `Skybound-unsigned.ipa`.

## Installing on iPhone

An **unsigned** IPA cannot be installed by simply tapping it on a normal iPhone. Choose one:

- **TrollStore** (recommended for supported iOS versions): install TrollStore, then open the IPA with it.
- **Sign it first**: use AltStore / Sideloadly / Xcode with a free Apple ID to sign, then install.
- **App Store / TestFlight**: needs a paid Apple Developer account (then change the workflow export step to `method: app-store`).

## Local build (if you own a Mac)

```bash
npm install
npx cap add ios
npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -configuration Release -sdk iphoneos -destination generic/platform=iOS \
  CODE_SIGNING_ALLOWED=NO SYMROOT="$(pwd)/build" build
mkdir -p out/Payload
cp -R build/Release-iphoneos/App.app out/Payload/App.app
cd out && zip -qr ../Skybound-unsigned.ipa Payload
```

## Dev account inside the app

`v11` / `qazxsw1` — unlimited coins, all outfits, invincible.
