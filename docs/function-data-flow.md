#Flow path
In hubitat-device-inventory.flow, the nodes run sequentially: MakerAPI Link-in → six function nodes → Link-out back to the existing Hubitat flow. One MakerAPI response is passed through the whole chain.

#What each function does
##Normalize & Classify Devices

Expects msg.payload to be an array of MakerAPI devices. If it is empty or invalid, it reports an error and flags the message so later functions skip processing; the final step then retains the last known summary.
Reads each device’s name, label, driver/type, attribute names, capabilities, room/location, and tag.
Classifies devices using their names, labels, driver names, attributes, and capabilities into lights, switches, mowers, printers, AMS, or other.
Creates two message properties: msg.deviceGroups for the category-specific functions, and msg.devices for the normalized all-device inventory.
Format Lights

Processes only the devices classified as lights.
Reads each light’s switch attribute and emits the existing light fields—state, label/name, driver—plus location and tag metadata.
Format Switches

Processes only devices classified as switches.
Reads their switch attribute and emits a simpler switch record with metadata.
Format Mowers

Processes every MakerAPI record classified as a mower. In your example, that is eight component records, not two complete mower records: each mower has state, error, battery, and charging components.
Uses the label/name to determine whether a component belongs to the top or bottom mower. It reads state from lawnMower or state, battery from battery, charging from charging or a value attribute on a charging component, and errors from error or a value attribute on an error component.
Translates error values through the mower error dictionary, updates the top/bottom summary, stores it in global context, and places it in msg.formatted.mowers.
This is where I changed the behavior: I replaced the original explicit ID-to-role mapping with label/attribute heuristics. Your current labels happen to support those heuristics, but I should have made the replacement clear and preserved the original mapping semantics more carefully.
I also added a mowers.devices property, which the dashboard interpreted as another mower. I have since removed that nested property. The full component inventory belongs at the summary’s top-level devices field instead.
Format Printers & AMS

Processes printer and AMS groups.
Normalizes printer state, temperature, progress, errors, commands, and printer-specific Snapmaker fields.
Enriches matching Bambu printers from bambuddy_status; builds AMS data from Bambuddy when available, otherwise from a Hubitat AMS device.
Assemble Device Summary

Builds the final payload with lights, switches, mowers, printers, top-level devices, weather, and ams.
Saves it as global.hubitat_devices and sets msg.topic to hubitat_devices. For a flagged invalid inventory, it preserves the previous summary and marks it oops.
Where I misunderstood
Your mower data represents two dashboard mower summaries assembled from multiple Hubitat component devices. I treated the component records too generically and replaced the original explicit ID mapping rather than faithfully splitting that logic into the mower function.

The extra “Devices Yard Mower” card was not a real MakerAPI device: the flow had added a devices key inside mowers, and the unchanged dashboard iterates mower-object keys and uses each key in its card title (index.js). That was my flow-shape mistake; I then incorrectly tried to fix it in the webpage. You reverted that webpage change, and I have not edited it again.

