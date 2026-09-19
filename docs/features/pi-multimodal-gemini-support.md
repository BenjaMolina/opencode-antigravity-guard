# ODD Feature: Pi Multimodal Gemini Support

## Goal
Enable full multimodal (image + text) support for Gemini models in @benjamolina/pi-antigravity-guard, allowing users to paste images and tools (such as ead) to process image files without session-breaking exceptions.

## Context & Problem
1. **Catalog advertised text-only**: 	oPiModelDescriptor in packages/pi/src/catalog.ts advertised input: ["text"]. When a user pasted an image in Pi, Pi warned [Current model does not support images. The image will be omitted from this request.].
2. **Crash on tool media results**: When a tool read an image file (e.g. ead screenshot.png), packages/pi/src/tool-context.ts threw PI_TOOL_RESULT_MEDIA_UNSUPPORTED whenever a part had 	ype !== "text". Because this result entered the conversation history, all subsequent turns threw the same error, permanently breaking the session.

## Architecture & Wire Mapping
1. **Model input descriptor**: Advertise input: ["text", "image"] for Gemini and Claude models in 	oPiModelDescriptor. Clean model display names to remove , text only.
2. **User image serialization**: In packages/pi/src/context.ts, map user { type: "image", data, mimeType } parts to Gemini { inlineData: { mimeType, data } }.
3. **Tool media tolerance & propagation**: In packages/pi/src/tool-context.ts, extract image parts from 	oolResult messages:
   - Provide fallback output text ("[Image content]") for unctionResponse.response.
   - Propagate inlineData parts in the replayed turn so Gemini receives both the tool call response and the image data.
   - Eliminate fatal PI_TOOL_RESULT_MEDIA_UNSUPPORTED exception.

## Work Units
- **Work Unit 1**: Implement multimodal image serialization in context.ts, 	ool-context.ts, and catalog.ts. Colocate unit tests in context.test.ts, 	ool-context.test.ts, catalog.test.ts, and provider.test.ts.
- **Work Unit 2**: Open PR linked to approved issue and publish release.
