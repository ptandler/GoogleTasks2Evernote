// configuration
const inFile = "./GoogleTasks.json";
const outPath = "Evernote";
const outFile = "./GoogleTasks.enex";
const exportGoogleTaskSelfLink = false; // export task.selfLink
const exportListAsTag = true; // if false, export each list as separate notebook .enex in outFile
const exportDate = formatTimestamp((new Date()).toISOString());
const listTagPrefix = "GoogleTasks/" + exportDate + "/";
// const listTagPrefix = "";
const hiddenTag = "hidden";
// const hiddenTag = null;
const completedTag = "completed";
const statusTagPrefix = "status:";
const scanHashTags = true;
const linkifyNotes = true;
const linkifyHashTags = true;
const debugTaskIdTag = false;

// required modules
const fs = require('fs');
const path = require('path');
const linkify = require('linkifyjs'); // http://soapbox.github.io/linkifyjs/
const linkifyHtml = require('linkifyjs/html');
if (scanHashTags || (linkifyNotes && linkifyHashTags)) {
	require('linkifyjs/plugins/hashtag')(linkify);
}
const taskAttributes = {};

let taskCounter = 0, listCounter = 0;

/* maybe use:
 *
 * https://github.com/jprichardson/node-fs-extra
 *     `npm install --save fs-extra`
 *
 * https://github.com/substack/minimist
 *     `npm install --save minimist`
 */
if (!fs.existsSync(outPath)) {
	fs.mkdirSync(outPath);
}

fs.readFile(inFile, (err, data) => {
	if (err) throw err;
	try {
		const tasksLists = JSON.parse(data);
		if (exportListAsTag) {
			exportTaskListsAsTags(tasksLists)
		} else {
			exportTaskLists(tasksLists);
		}
		console.info("Lists converted: " + listCounter);
		console.info("Task converted: " + taskCounter);

		// console.info(JSON.stringify(Object.keys(taskAttributes)));
	} catch (e) {
		throw e;
	}
});

function exportTaskLists(lists) {
	for (let list of lists.items) {
		listCounter++;
		let data = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export2.dtd">
`;

		data += "<en-export export-date=\"" + exportDate + "\" application=\"Evernote/Windows\" version=\"6.x\">\n";
		let tasks = list.items, oldTaskCounter = taskCounter;
		if (tasks) {
			for (let j in tasks) {
				data += exportTask(tasks[j])
			}
		}
		data += "</en-export>\n";

		fs.writeFile(path.join(outPath, list.title + ".enex"), data, (err) => {
			if (err) {
				throw err;
			}
		});
		console.info("Exported list " + list.title + ": " + (taskCounter - oldTaskCounter) + " tasks");
	}
}

function exportTaskListsAsTags(lists) {
	let data = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export2.dtd">
`;
	data += "<en-export export-date=\"" + exportDate + "\" application=\"Evernote/Windows\" version=\"6.x\">\n";
	for (let list of lists.items) {
		listCounter++;

		let tasks = list.items, oldTaskCounter = taskCounter;
		if (tasks) {
			for (let task of tasks) {
				data += exportTask(task, list.title)
			}
		}
		console.info("Exported list " + list.title + ": " + (taskCounter - oldTaskCounter) + " tasks");
	}
	data += "</en-export>\n";

	fs.writeFile(outFile, data, (err) => {
		if (err) {
			throw err;
		}
	});
}

function exportTask(task, tag) {
	/*
	  "id": "MDQ4NDU5OTAwMzQxNTcwMjM1OTU6Njk3NDQxMDY0OjUzOTA2ODI5OTkxMTIxNjg",
	  "title": "...",
	  "notes": "....",
	  "status" : "needsAction",
      "status" : "completed",
      "due" : "2018-03-17T00:00:00.000Z",
      "updated" : "2018-03-17T18:24:57.000Z",
      "completed" : "2018-03-17T18:24:57.000Z",
      "hidden" : true, // = deleted
	  "parent": "MDQ4NDU5OTAwMzQxNTcwMjM1OTU6Njk3NDQxMDY0OjUzOTA2ODI5OTkxMTIxNjg", // used by sub tasks to identify parent task
      "links" : [ {
        "type" : "email",
        "description" : "Some Email Topic",
        "link" : "https://mail.google.com/mail/#all/160b33baebc3eaef"
      } ],
      "selfLink" : "https://www.googleapis.com/tasks/v1/lists/MDQ4NDU5OTAwMzQxNTcwMjM1OTU6Njk3NDQxMDY0OjA/tasks/MDQ4NDU5OTAwMzQxNTcwMjM1OTU6Njk3NDQxMDY0OjE5MjQyNzgyMzE",
	 */
	// first collect all task attributes used by Google Task export
	for (let attribute in task) {
		taskAttributes[attribute] = "";
	}

	if (task.hidden && !hiddenTag) {
		// don't export hidden tasks if no hidden tag is defined
		return "";
	}

	taskCounter++;

	// export task
	let result = `<!-- task-${taskCounter} ${task.id} ${task.selfLink} -->\n`;
	result += "\t<note>\n";
	let title = "(no title)";
	if (task.title) {
		title = task.title;
	}
	result += "\t\t<title>";
	result += escapeHtml(title);
	result += "</title>\n";
	let notes = "";
	if (task.notes) {
		let html = escapeHtml(task.notes);
		if (linkifyNotes) {
			notes = linkifyHtml(html, {nl2br: true, className: "", target: "",
				format: (value, type) => escapeHtml(value)
			}).replace(/<br>/g, "<br/>\n");
		} else {
			notes = html.replace(/\n/g, "<br/>\n");
		}
	}
	if (task.links) {
		for (let link of task.links) {
			notes += `<p><a href='${link.link}' target="_blank">${escapeHtml(link.description)} (${escapeHtml(link.type)})</a></p>\n`;
		}
	}
	result += `\t\t<content><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><div>${notes}<br/></div></en-note>]]></content>
`;
	if (task.updated) {
		result += `\t\t<created>${formatTimestamp(task.updated)}</created>\n`; // not supported in Google Tasks
		result += `\t\t<updated>${formatTimestamp(task.updated)}</updated>\n`;
	}

	// tag (multiple possible) - use this to tag the google task list (if passed as argument)
	if (tag) {
		result += `\t\t<tag>${listTagPrefix ? escapeHtml(listTagPrefix) : ""}${escapeHtml(tag)}</tag>\n`;
	}
	if (debugTaskIdTag) {
		// result += `\t\t<tag>id-${task.id}</tag>\n`;
		result += `\t\t<tag>task-${taskCounter}</tag>\n`;
	}
	if (task.hidden) {
		result += `\t\t<tag>${escapeHtml(hiddenTag)}</tag>\n`;
	}
	if (task.completed) {
		result += `\t\t<tag>${escapeHtml(completedTag)}</tag>\n`;
	}
	if (task.status) {
		result += `\t\t<tag>${statusTagPrefix ? escapeHtml(statusTagPrefix) : ""}${escapeHtml(task.status)}</tag>\n`;
	}
	if (task.notes && scanHashTags) {
		let hashtags = linkify.find(task.notes);
		// console.dir(hashtags);
		for (let hash of hashtags) {
			if (hash.type === "hashtag") {
				result += `\t\t<tag>${listTagPrefix ? 
					escapeHtml(listTagPrefix) : ""}tag/${escapeHtml(hash.value.substr(1))}</tag>\n`;
			}
		}
	}

	// note-attributes
	result += "<note-attributes>\n";
	if (task.due) {
		result += `<reminder-order>${formatTimestamp(task.due)}</reminder-order>\n`;
		result += `<reminder-time>${formatTimestamp(task.due)}</reminder-time>\n`;
	}
	if (task.completed) {
		// if no due date is specified, take the completed date
		result += `<reminder-order>${formatTimestamp(task.due ? task.due : task.completed)}</reminder-order>\n`;
		result += `<reminder-time>${formatTimestamp(task.due ? task.due : task.completed)}</reminder-time>\n`;
		result += `<reminder-done-time>${formatTimestamp(task.completed)}</reminder-done-time>\n`;
	}

	if (task.links && task.links[0]) {
		result += `<source-url>${task.links[0].link}</source-url>`;
	} else if (task.selfLink && exportGoogleTaskSelfLink) {
		result += `<source-url>${task.selfLink}</source-url>`;
	}
	result += "</note-attributes>\n";
	result += "\t</note>\n";
	return result;
}

function escapeHtml(string) {
	if (!string) {
		return "";
	}
	return string
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function formatTimestamp(string) {
	return escapeHtml(string.replace(/[:.\-]/g, ""));
}