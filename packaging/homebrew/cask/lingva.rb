cask "lingva" do
  arch arm: "aarch64", intel: "x86_64"

  version "0.1.3"
  sha256 arm:   "c31d78bb2f16a2a5114f17acb9fa480670cea68d5f4c9b1649791dd65ace35cf",
         intel: "e816ca9b6437fc6a6f4c5c9065ae8cf961eb33e3ce125ef061fb36265c8738ab"

  url "https://github.com/usausoft/homebrew-tap/releases/download/cli/v#{version}/lingva-#{arch}-apple-darwin.tar.gz",
      verified: "github.com/usausoft/homebrew-tap/"
  name "Lingva"
  desc "Customer CLI for the Lingva localization platform"
  homepage "https://lingva.dev/"

  livecheck do
    url "https://github.com/usausoft/homebrew-tap"
    regex(/^cli\/v(\d+(?:\.\d+)+)$/i)
    strategy :github_latest
  end

  depends_on :macos

  binary "lingva"
end
