"use client"

function base64UrlToBuffer(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = window.atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let value = ""
  for (const byte of bytes) value += String.fromCharCode(byte)
  return window.btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

type CredentialDescriptorJSON = Omit<PublicKeyCredentialDescriptor, "id"> & { id: string }

type CredentialCreationOptionsJSON = Omit<PublicKeyCredentialCreationOptions, "challenge" | "user" | "excludeCredentials"> & {
  challenge: string
  user: Omit<PublicKeyCredentialUserEntity, "id"> & { id: string }
  excludeCredentials?: CredentialDescriptorJSON[]
}

export function supportsPasskeys() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials?.create
}

export async function createPasskeyCredential(options: CredentialCreationOptionsJSON) {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64UrlToBuffer(options.challenge),
    user: { ...options.user, id: base64UrlToBuffer(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  }

  const credential = await navigator.credentials.create({ publicKey })
  if (!(credential instanceof PublicKeyCredential)) throw new Error("invalid_passkey_credential")
  const response = credential.response
  if (!(response instanceof AuthenticatorAttestationResponse)) throw new Error("invalid_passkey_response")

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  }
}
