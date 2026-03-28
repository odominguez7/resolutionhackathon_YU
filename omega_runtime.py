#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Anniversary Gift Console Experience - Hacker Edition
Single-file Python script. No external libraries needed.
Run with: python anniversary_llm_gift.py
"""

import os
import sys
import time
import shutil
import random
import getpass


# ---------- Style helpers ----------
def supports_ansi():
    return sys.stdout.isatty()

USE_ANSI = supports_ansi()

class C:
    RESET = "\033[0m" if USE_ANSI else ""
    BOLD = "\033[1m" if USE_ANSI else ""
    DIM = "\033[2m" if USE_ANSI else ""
    GREEN = "\033[92m" if USE_ANSI else ""
    CYAN = "\033[96m" if USE_ANSI else ""
    BLUE = "\033[94m" if USE_ANSI else ""
    MAGENTA = "\033[95m" if USE_ANSI else ""
    YELLOW = "\033[93m" if USE_ANSI else ""
    RED = "\033[91m" if USE_ANSI else ""
    GRAY = "\033[90m" if USE_ANSI else ""

def clear():
    os.system("cls" if os.name == "nt" else "clear")

def width():
    try:
        return shutil.get_terminal_size((90, 24)).columns
    except Exception:
        return 90

def line(char="─"):
    print(char * min(width(), 100))

def typewrite(text, delay=0.012, newline=True):
    for ch in text:
        print(ch, end="", flush=True)
        time.sleep(delay)
    if newline:
        print()

def slow_dots(base, cycles=3, delay=0.35):
    print(base, end="", flush=True)
    for _ in range(cycles):
        time.sleep(delay)
        print(".", end="", flush=True)
    print()

def boxed(title, color=C.CYAN):
    w = min(width(), 100)
    title_text = f" {title} "
    left = max(2, (w - len(title_text)) // 2)
    right = max(2, w - len(title_text) - left)
    print(color + ("═" * left) + title_text + ("═" * right) + C.RESET)

def progress(label, steps=18, delay=0.06):
    print(f"{C.GRAY}{label}{C.RESET}")
    for i in range(steps + 1):
        filled = "█" * i
        empty = "░" * (steps - i)
        pct = int(i / steps * 100)
        print(f"\r  [{C.GREEN}{filled}{C.RESET}{empty}] {pct:>3}%", end="", flush=True)
        time.sleep(delay)
    print()

def reveal_item(title, value, color=C.GREEN):
    print(f"{color}✔{C.RESET} {C.BOLD}{title}{C.RESET}")
    time.sleep(0.22)
    if isinstance(value, (list, tuple)):
        for item in value:
            typewrite(f"   → {item}", delay=0.01)
            time.sleep(0.14)
    else:
        typewrite(f"   → {value}", delay=0.01)
    time.sleep(0.18)

def matrix_line(length=72):
    chars = "01ABCDEFabcdef#$%&*@+=<>?/\\|[]{}"
    return "".join(random.choice(chars) for _ in range(length))

def hacker_burst(lines=12, delay=0.045):
    for _ in range(lines):
        print(f"{C.GREEN}{matrix_line(min(width() - 2, 92))}{C.RESET}")
        time.sleep(delay)

def status(msg, value=None, color=C.GREEN):
    if value is None:
        print(f"{color}[OK]{C.RESET} {msg}")
    else:
        print(f"{color}[OK]{C.RESET} {msg}: {value}")

def pause(seconds=0.6):
    time.sleep(seconds)


# ---------- Experience ----------
ACCESS_KEY = "unodecincuenta"
PARTNER = "Omar"
FROM = "Maggie"

def intro():
    clear()
    boxed("OMEGA RUNTIME // PRIVATE ANNIVERSARY BUILD", C.GREEN)
    print()
    print(f"{C.GREEN}root@localnode{C.RESET}:{C.BLUE}~/anniversary{C.RESET}$ ./initialize_runtime")
    time.sleep(0.4)
    hacker_burst(8, 0.04)
    print()
    typewrite(f"{C.GREEN}[BOOT]{C.RESET} Spinning up protected execution layer...", 0.012)
    typewrite(f"{C.GREEN}[BOOT]{C.RESET} Establishing local inference environment...", 0.012)
    typewrite(f"{C.GREEN}[BOOT]{C.RESET} No external calls detected. Safe mode enabled.", 0.012)
    print()
    pause(0.6)

def auth_gate():
    progress("Loading encrypted modules", 16, 0.05)
    progress("Verifying local permissions", 14, 0.05)
    progress("Mounting surprise payload", 13, 0.05)
    print()

    attempts = 3
    for attempt in range(1, attempts + 1):
        prompt = f"{C.BOLD}{C.GREEN}ENTER ACCESS KEY > {C.RESET}"
        try:
            entered = getpass.getpass(prompt)
        except Exception:
            entered = input(prompt)

        if entered.strip().lower() == ACCESS_KEY:
            print(f"{C.GREEN}[AUTH]{C.RESET} Access granted.")
            pause(0.4)
            typewrite(f"{C.GREEN}[DECRYPT]{C.RESET} Decrypting protected memory block...", 0.012)
            pause(0.7)
            return True

        remaining = attempts - attempt
        print(f"{C.RED}[AUTH]{C.RESET} Invalid key.", end="")
        if remaining:
            print(f" {remaining} attempt(s) remaining.")
        else:
            print()
        pause(0.5)

    return False

def llm_sequence():
    clear()
    boxed("LLM EXECUTION TRACE", C.GREEN)
    print()
    print(f"{C.GREEN}> system.load(profile='meaningful_experiences'){C.RESET}")
    time.sleep(0.3)
    print(f"{C.GREEN}> user.request(target='{PARTNER}', occasion='first_wedding_anniversary'){C.RESET}")
    time.sleep(0.4)
    print()
    slow_dots(f"{C.YELLOW}running inference{C.RESET}", 5, 0.24)
    hacker_burst(6, 0.03)
    print()

    reveal_item("Selecting destination...", "New York City")
    reveal_item("Identifying meaningful experience...", "Death of a Salesman")
    reveal_item("Adding logistics...", ["Round trip train", "1 night hotel stay"])
    reveal_item("Optimizing emotional impact...", "High")
    reveal_item("Including partner...", FROM)

    print()
    line()
    print(f"{C.BOLD}Result:{C.RESET}")
    typewrite("An unforgettable anniversary experience in NYC.", 0.014)
    print()
    print(f"{C.BOLD}Status:{C.RESET}")
    typewrite("Ready to execute.", 0.014)
    print()
    print(f"{C.BOLD}Confidence:{C.RESET}")
    typewrite("100%", 0.018)
    line()
    print()

def secret_reveal():
    typewrite(f"{C.GREEN}[SCAN]{C.RESET} Searching for hidden variables...", 0.012)
    progress("Decrypting emotional payload", 18, 0.055)
    print()
    typewrite(f'{C.GREEN}Hidden variable detected:{C.RESET}  reason_for_plan = "te kiero mini"', 0.015)
    time.sleep(0.5)
    print()
    typewrite(f"{C.DIM}# built by Maggie, who apparently learned to code for this{C.RESET}", 0.018)
    print()
    boxed("EXECUTION COMPLETE", C.GREEN)

def goodbye():
    print()
    typewrite(f"{C.GRAY}Press Enter to close session...{C.RESET}", 0.01, newline=False)
    try:
        input()
    except EOFError:
        pass

def main():
    intro()
    ok = auth_gate()
    if not ok:
        print()
        typewrite(f'{C.RED}[FATAL]{C.RESET} unauthorized user. Terminating process.', 0.02)
        sys.exit(1)

    llm_sequence()
    secret_reveal()
    goodbye()

if __name__ == "__main__":
    main()
